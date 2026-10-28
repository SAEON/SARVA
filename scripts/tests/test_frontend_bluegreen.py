import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('bluegreen', Path(__file__).parents[1] / 'deploy-frontend-bluegreen.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)

CONFIG = 'server { server_name sarva.saeon.ac.za; location / { proxy_pass http://127.0.0.1:8090; } }\n'

class BlueGreenTest(unittest.TestCase):
    def test_port_selection_and_scoped_rewrite(self):
        text = CONFIG + '# Preserve all other directives\n'
        self.assertEqual(deploy.active_port(text), 8090)
        self.assertEqual(deploy.switched_config(text, 8091), text.replace(':8090;', ':8091;'))
        self.assertEqual(deploy.active_port(deploy.switched_config(text, 8091)), 8091)

    def test_ambiguous_or_unexpected_upstream_rejected(self):
        for text in [CONFIG + CONFIG, CONFIG.replace('8090', '5180'), '']:
            with self.assertRaises(RuntimeError):
                deploy.active_port(text)

    def exercise(self, mode):
        with tempfile.TemporaryDirectory() as folder:
            config = Path(folder) / 'sarva.conf'
            config.write_text(CONFIG)
            state = dict(status='prepared', original=CONFIG, old_port=8090, new_port=8091, candidate_id='candidate')
            calls, saved = [], []
            def run(*args, **kwargs):
                calls.append(args)
                if args[:2] == ('docker', 'inspect'):
                    return 'candidate\n'
                if mode == 'reload-fail' and args == ('systemctl', 'reload', 'nginx') and calls.count(args) == 1:
                    raise RuntimeError('simulated reload failure')
            def readiness(port):
                if mode == 'unready':
                    raise RuntimeError('unready')
            if mode == 'drift':
                config.write_text(CONFIG + '# someone changed config\n')
            with patch.object(deploy, 'CONFIG', config), patch.object(deploy, 'run', run), patch.object(deploy, 'ready', readiness), patch.object(deploy, 'probe', return_value=mode != 'https-fail'), patch.object(deploy, 'save_state', side_effect=lambda data: saved.append(dict(data))):
                if mode == 'ok':
                    deploy.switch(state)
                    self.assertEqual(deploy.active_port(config.read_text()), 8091)
                    self.assertEqual(saved[-1]['status'], 'switched')
                    deploy.rollback(state)
                    self.assertEqual(config.read_text(), CONFIG)
                    self.assertEqual(saved[-1]['status'], 'rolled-back')
                else:
                    with self.assertRaises(RuntimeError):
                        deploy.switch(state)
                    expected = CONFIG + '# someone changed config\n' if mode == 'drift' else CONFIG
                    self.assertEqual(config.read_text(), expected)
                    self.assertEqual(saved, [])
                    if mode in ('drift', 'unready'):
                        self.assertNotIn(('systemctl', 'reload', 'nginx'), calls)

    def test_switch_and_rollback(self): self.exercise('ok')
    def test_candidate_failure_keeps_live_config(self): self.exercise('unready')
    def test_config_drift_prevents_switch(self): self.exercise('drift')
    def test_reload_failure_restores_original(self): self.exercise('reload-fail')
    def test_https_failure_restores_original(self): self.exercise('https-fail')

if __name__ == '__main__':
    unittest.main()

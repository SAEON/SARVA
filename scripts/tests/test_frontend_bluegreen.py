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

class ImagePreservationTest(unittest.TestCase):
    def test_original_image_is_pinned_without_snapshot(self):
        calls = []
        def run(*args, **kwargs):
            calls.append(args)
            return 'sha256:original' if '{{.Image}}' in args else 'sha256:pinned'
        with patch.object(deploy, 'run', run):
            self.assertEqual(deploy.preserve_frontend_image('frontend', 'rollback'), 'original image')
        self.assertFalse(any(args[:2] == ('docker', 'commit') for args in calls))

    def test_missing_image_requires_verified_explicit_recovery(self):
        calls = []
        def run(*args, **kwargs):
            calls.append(args)
            if args[:3] == ('docker', 'tag', 'sha256:missing'):
                raise deploy.subprocess.CalledProcessError(1, args)
            if '{{.Image}}' in args: return 'sha256:missing'
            if '{{.State.Running}}' in args: return 'true'
            if '{{json .Mounts}}' in args: return '[]'
            if args[:2] == ('docker', 'inspect'): return 'frontend'
            return 'sha256:recovered'
        with patch.object(deploy, 'run', run), patch.object(deploy, 'verify_recovery_image') as verify:
            self.assertEqual(deploy.preserve_frontend_image('frontend', 'rollback', 'recovery'), 'verified reconstructed static frontend image')
            verify.assert_called_once_with('frontend', 'recovery')
        self.assertIn(('docker', 'tag', 'recovery', 'rollback'), calls)
        self.assertFalse(any(args[:2] == ('docker', 'commit') for args in calls))

    def test_mounted_frontend_refuses_snapshot(self):
        def run(*args, **kwargs):
            if args[:2] == ('docker', 'tag'): raise deploy.subprocess.CalledProcessError(1, args)
            if '{{.Image}}' in args: return 'sha256:missing'
            if '{{.State.Running}}' in args: return 'true'
            if '{{json .Mounts}}' in args: return '[{"Destination":"/usr/share/nginx/html"}]'
            return 'frontend'
        with patch.object(deploy, 'run', run), self.assertRaises(RuntimeError):
            deploy.preserve_frontend_image('frontend', 'rollback')

class RecoveryFileTest(unittest.TestCase):
    def test_matching_files_allow_extra_old_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            a, b = Path(directory)/'a', Path(directory)/'b'
            a.mkdir(); b.mkdir()
            (a/'index.html').write_text('same'); (b/'index.html').write_text('same')
            (b/'old-asset.js').write_text('old')
            deploy.verify_file_tree(a,b)
            (b/'index.html').write_text('different')
            with self.assertRaises(RuntimeError): deploy.verify_file_tree(a,b)
    def test_empty_or_missing_files_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            a,b=Path(directory)/'a',Path(directory)/'b'; a.mkdir(); b.mkdir()
            with self.assertRaises(RuntimeError): deploy.verify_file_tree(a,b)
            (a/'index.html').write_text('required')
            with self.assertRaises(RuntimeError): deploy.verify_file_tree(a,b)

if __name__ == '__main__':
    unittest.main()

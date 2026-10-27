import {NavLink} from 'react-router-dom';
export default function AdminSections(){return <nav className="ua-sections" aria-label="Administration sections"><NavLink to="/admin/users">Users &amp; roles</NavLink><NavLink to="/testing">Issues &amp; feedback</NavLink></nav>;}

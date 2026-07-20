import { useLocation } from "react-router-dom";
import Search from "../pages/Search.jsx";

export default function SearchRoute() {
    const location = useLocation();
    return <Search key={location.search} />;
}

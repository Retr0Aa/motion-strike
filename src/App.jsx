import { Route, Routes } from "react-router-dom";
import Game from "./Page/Game";
import MainMenu from "./Page/MainMenu";
import "./App.css";
import OptionsMenu from "./Page/OptionsMenu";

export default function App() {
    return (
        <div className="App">
            <Routes>
                <Route path="/" element={<MainMenu />} />
                <Route path="/game" element={<Game />} />
                <Route path="/options" element={<OptionsMenu />} />
            </Routes>
        </div>
    );
}

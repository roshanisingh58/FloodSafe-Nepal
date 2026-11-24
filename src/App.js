import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import Home from "./Components/Home";
import Dashboard from "./Components/Dashboard";
import Features from "./Components/Features";
import About from "./Components/About";
import Respond from "./Components/Respond";
import Alert from "./Components/Alert";


function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/Features" element={<Features />} />
          <Route path="/About" element={<About />} />
          <Route path="/Respond" element={<Respond view="plan" />} />
          <Route path="/closures" element={<Respond view="closures" />} />
          <Route path="/shelters" element={<Respond view="shelters" />} />
          <Route path="/ambulance" element={<Respond view="ambulance" />} />
          <Route path="/chokepoints" element={<Respond view="chokepoints" />} />
          <Route path="/Alert" element ={<Alert />} />
          {/* any other address (e.g. old footer links) goes home instead of a blank white page */}
          <Route path="*" element={<Navigate to="/" replace />} />


        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './Header';
import About from './About';
import Home from './Home';
import './App.css';


const App = () => {
  return (
    <Router>
      <Header />
      {/* Padding yerine genel bir className ya da düzenleme yapılabilir */}
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;

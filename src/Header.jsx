import React from 'react';
import { Link } from 'react-scroll';
import './Header.css';
import logo from './assets/images/usf_logo.png'; // Logonuzun doğru yolunu kontrol edin

const Header = () => {
  // Mobil cihazlarda kaydırma süresini artırmak için ekran genişliğini kontrol et
  const isMobile = window.innerWidth <= 480; // 480px genişlik sınırı
  const scrollDuration = isMobile ? 800 : 400; // Mobilde daha yavaş kaydırma

  return (
    <header className="header">
      <div className="logo-container">
        <a href="/">
          <img src={logo} alt="Logo" className="logo" />
        </a>
      </div>
      <nav>
        <ul className="nav-list">
          <li>
            <Link
              to="home-section"
              smooth={true}
              duration={scrollDuration}
              className="home-link"
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              to="about-section"
              smooth={true}
              duration={scrollDuration}
              offset={-120}
              className="about-link"
            >
              About
            </Link>
          </li>
          <li>
            <Link
              to="events-section"
              smooth={true}
              duration={scrollDuration}
              offset={-70}
              className="events-link"
            >
              Innovations
            </Link>
          </li>
          <li>
            <Link
              to="profile-section"
              smooth={true}
              duration={scrollDuration}
              offset={-50}
              className="profile-link"
            >
              Profile
            </Link>
          </li>
          <li>
            <Link
              to="join-section"
              smooth={true}
              duration={scrollDuration}
              className="join-link"
            >
              Join
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default Header;

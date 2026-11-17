import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import AuthMenu from './AuthMenu.jsx';
import CartLink from './CartLink.jsx';
import { API_BASE } from '../apiBase.js';

function storedToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function BoardNavLink({ onClick }) {
  const [show, setShow] = useState(() => Boolean(storedToken()));

  useEffect(() => {
    const token = storedToken();
    if (!token) {
      setShow(false);
      return undefined;
    }
    let ignore = false;
    fetch(`${API_BASE}/api/me`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!ignore) setShow(response.ok);
      })
      .catch(() => {
        if (!ignore) setShow(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (!show) return null;
  return (
    <NavLink to="/board" onClick={onClick}>
      게시판
    </NavLink>
  );
}

function SiteNav({ onToggleTheme }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(() => Boolean(storedToken()));

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const token = storedToken();
    if (!token) {
      setSignedIn(false);
      return undefined;
    }
    let ignore = false;
    fetch(`${API_BASE}/api/me`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!ignore) setSignedIn(response.ok);
      })
      .catch(() => {
        if (!ignore) setSignedIn(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="nav">
      <div className="wrap nav-bar">
        <a className="brand" href="/bomul.html" onClick={closeMenu}>
          <span className="seal">寶</span>보물 여행
        </a>
        <button
          className="nav-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ☰
        </button>
        <nav className="nav-links" aria-label="주요 메뉴">
          <a href="/bomul.html">홈</a>
          <a href="/bomul.html#courses">전체 코스</a>
          <BoardNavLink />
        </nav>
        <div className="nav-tools">
          <button className="toggle" type="button" onClick={onToggleTheme}>
            ◑ 테마
          </button>
          <AuthMenu />
          <CartLink />
        </div>
      </div>
      <nav
        className={`nav-drawer${menuOpen ? ' is-open' : ''}`}
        id="mobile-nav"
        aria-label="모바일 메뉴"
      >
        <a href="/bomul.html" onClick={closeMenu}>
          홈
        </a>
        <a href="/bomul.html#courses" onClick={closeMenu}>
          전체 코스
        </a>
        <NavLink to="/cart" onClick={closeMenu}>
          장바구니
        </NavLink>
        <NavLink to="/order" onClick={closeMenu}>
          주문
        </NavLink>
        {signedIn ? null : (
          <>
            <NavLink to="/login" onClick={closeMenu}>
              로그인
            </NavLink>
            <NavLink to="/signup" onClick={closeMenu}>
              회원가입
            </NavLink>
          </>
        )}
      </nav>
    </header>
  );
}

export default SiteNav;

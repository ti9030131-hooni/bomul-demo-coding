import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './admin.css';
import { API_BASE } from '../apiBase.js';

function storedToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function roleLabel(userType) {
  return userType === 'admin' ? '관리자' : '회원';
}

function joinLabel(provider) {
  return provider === 'naver' ? '네이버' : '직접 가입';
}

function MembersPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = storedToken();
    if (!token) {
      navigate('/', { replace: true });
      return undefined;
    }

    let ignore = false;
    fetch(`${API_BASE}/api/me`, { headers: { authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (ignore) return;
        const user = response.ok ? await response.json() : null;
        if (user?.user_type !== 'admin') {
          navigate('/', { replace: true });
          return;
        }
        setAllowed(true);
        try {
          const usersResponse = await fetch(`${API_BASE}/api/users`, {
            headers: { authorization: `Bearer ${token}` },
          });
          const saved = await usersResponse.json().catch(() => null);
          if (ignore) return;
          if (!usersResponse.ok || !Array.isArray(saved)) {
            setError(saved?.message || '회원 목록을 불러오지 못했습니다.');
            return;
          }
          setMembers(saved);
        } catch {
          if (!ignore) setError('서버에 연결하지 못했습니다. 서버가 실행 중인지 확인해 주세요.');
        }
      })
      .catch(() => {
        if (!ignore) navigate('/', { replace: true });
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [navigate]);

  if (!allowed) return null;

  const keyword = query.trim().toLowerCase();
  const visible = members.filter((member) => {
    const text = [member.user_id, member.name, member.nickname, member.email, member.phone].join(' ').toLowerCase();
    return text.includes(keyword);
  });

  return (
    <div className="admin-app">
      <header className="admin-top">
        <div className="admin-brand">
          <Link to="/">보물 여행</Link>
          <span>ADMIN</span>
        </div>
        <Link to="/admin">대시보드로 돌아가기</Link>
      </header>

      <main className="admin-main admin-course-page">
        <div className="admin-course-head">
          <div>
            <h1>가입된 회원</h1>
            <p className="admin-lead">{loading ? '목록을 확인하고 있습니다.' : `총 ${members.length.toLocaleString('ko-KR')}명`}</p>
          </div>
        </div>

        <div className="admin-course-tools">
          <label className="admin-course-search">
            <span className="sr-only">회원 검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="아이디, 이름, 이메일로 검색"
            />
          </label>
        </div>

        {error ? (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="admin-course-table-wrap">
          <table className="admin-course-table">
            <thead>
              <tr>
                <th>아이디</th>
                <th>이름</th>
                <th>닉네임</th>
                <th>이메일</th>
                <th>전화번호</th>
                <th>가입</th>
                <th>유형</th>
                <th>멤버십</th>
                <th>가입일</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="admin-course-empty" colSpan="9">
                    회원 목록을 불러오는 중입니다.
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td className="admin-course-empty" colSpan="9">
                    {members.length === 0 ? '가입된 회원이 없습니다.' : '검색과 맞는 회원이 없습니다.'}
                  </td>
                </tr>
              ) : (
                visible.map((member) => (
                  <tr key={member._id}>
                    <td>{member.user_id}</td>
                    <td>{member.name}</td>
                    <td>{member.nickname || '—'}</td>
                    <td>{member.email}</td>
                    <td>{member.phone}</td>
                    <td>{joinLabel(member.provider)}</td>
                    <td>
                      <em className={member.user_type === 'admin' ? 'admin-member-role is-admin' : 'admin-member-role'}>
                        {roleLabel(member.user_type)}
                      </em>
                    </td>
                    <td>{member.membership?.active ? '이용 중' : '없음'}</td>
                    <td>{formatDate(member.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default MembersPage;

import { randomBytes } from 'node:crypto';
import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';

const CLIENT_URL = (process.env.CLIENT_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL
  ?? 'http://localhost:4000/api/login/google/callback';
const STATE_COOKIE = 'google_state';
const STATE_COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax', path: '/api/login/google' };

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function redirectToClient(res, params) {
  res.redirect(`${CLIENT_URL}/login/google#${new URLSearchParams(params)}`);
}

function readCookie(req, name) {
  for (const part of (req.get('cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return '';
}

export function googleStart(req, res) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    redirectToClient(res, {
      error: '구글 로그인 설정이 없습니다. server/.env의 GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET을 확인하세요.',
    });
    return;
  }

  const state = randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, { ...STATE_COOKIE_OPTIONS, maxAge: 10 * 60 * 1000 });
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

async function fetchGoogleProfile(code) {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: CALLBACK_URL,
      code,
    }),
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenData.access_token) {
    throw new Error(`구글 토큰 발급 실패: ${tokenData.error_description || tokenData.error || tokenResponse.status}`);
  }

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profile.sub) {
    throw new Error(`구글 프로필 조회 실패: ${profile.error_description || profile.error || profileResponse.status}`);
  }
  return profile;
}

export async function findOrCreateGoogleUser(profile) {
  const existing = await User.findOne({ google_id: profile.sub });
  if (existing) return existing;

  if (!profile.email) {
    throw httpError(400, '구글에서 이메일 정보를 받지 못했습니다. 이메일 제공에 동의한 뒤 다시 시도해 주세요.');
  }
  if (profile.email_verified === false) {
    throw httpError(400, '이메일 인증이 끝난 구글 계정으로 다시 시도해 주세요.');
  }

  const email = profile.email.trim().toLowerCase();
  if (await User.exists({ email })) {
    throw httpError(409, '같은 이메일로 가입된 계정이 있습니다. 아이디와 비밀번호로 로그인해 주세요.');
  }

  const name = (profile.name || email.split('@')[0] || '구글회원').trim();
  return User.create({
    provider: 'google',
    google_id: profile.sub,
    user_id: `google_${profile.sub}`,
    name,
    nickname: name,
    email,
  });
}

export async function googleCallback(req, res) {
  const savedState = readCookie(req, STATE_COOKIE);
  res.clearCookie(STATE_COOKIE, STATE_COOKIE_OPTIONS);

  if (req.query.error) {
    const message = req.query.error === 'access_denied' ? '구글 로그인을 취소했습니다.' : '구글 로그인에 실패했습니다.';
    redirectToClient(res, { error: message });
    return;
  }

  const { code, state } = req.query;
  if (typeof code !== 'string' || typeof state !== 'string' || !savedState || state !== savedState) {
    redirectToClient(res, { error: '구글 로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.' });
    return;
  }

  try {
    const profile = await fetchGoogleProfile(code);
    const user = await findOrCreateGoogleUser(profile);
    redirectToClient(res, { token: signToken(user) });
  } catch (error) {
    const status = error.status ?? 500;
    if (status >= 500) console.error(error);
    redirectToClient(res, { error: status < 500 ? error.message : '구글 로그인에 실패했습니다.' });
  }
}

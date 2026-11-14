import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import './admin.css';
import { API_BASE } from '../apiBase.js';
const INFO_FIELDS = ['거리', '소요시간', '난이도', '집결지'];
// 3D 보물 기본 모델(/ar/models). 디자이너 모델은 '직접 입력'에 주소를 넣습니다.
const AR_MODELS = [
  { value: '', label: '자동(순서대로)' },
  { value: 'models/haechi-horn.glb', label: '해치의 뿔' },
  { value: 'models/deume-mirror.glb', label: '드므(물그릇)' },
  { value: 'models/dragon-pearl.glb', label: '용의 여의주' },
  { value: 'models/amisan-chimney.glb', label: '굴뚝' },
  { value: 'models/mulbul-ember.glb', label: '등롱(불씨)' },
];

function blankStopAr() {
  return { key: '', label: '', piece: '', q: '', qctx: '', optsText: '', a: '', explain: '', look: '', cert: '', photo: '', restore: '', restoreYear: '', restoreCaption: '', model: '' };
}

function blankCourseAr() {
  return {
    enabled: true, place: '', unit: '', finalName: '', sealShort: '', h1: '', storyText: '',
    deed: '', allDone: '', duration: '', nextSeason: '', storageKey: '', onsiteRadius: '', insideRadius: '', finalModel: '',
  };
}

function stopArFromCourse(ar = {}) {
  return {
    ...blankStopAr(),
    ...Object.fromEntries(Object.entries(ar).filter(([, value]) => value !== null && value !== undefined)),
    optsText: (ar.opts || []).join('\n'),
    a: Number.isInteger(ar.a) ? String(ar.a) : '',
  };
}

function courseArFromCourse(ar = {}) {
  return {
    ...blankCourseAr(),
    ...Object.fromEntries(Object.entries(ar).filter(([, value]) => value !== null && value !== undefined)),
    enabled: ar.enabled !== false,
    storyText: (ar.story || []).join('\n'),
    onsiteRadius: ar.onsiteRadius ?? '',
    insideRadius: ar.insideRadius ?? '',
  };
}

function stopArToBody(ar) {
  const opts = ar.optsText.split('\n').map((item) => item.trim()).filter(Boolean);
  const rest = { ...ar };
  delete rest.optsText;
  return { ...rest, opts, a: ar.a === '' ? null : Number(ar.a) };
}

function courseArToBody(ar) {
  const rest = { ...ar };
  delete rest.storyText;
  return { ...rest, story: ar.storyText.split('\n').map((item) => item.trim()).filter(Boolean) };
}

function storedToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function blankStop() {
  return { where: '', name: '', desc: '', addr: '', lat: '', lng: '', ar: blankStopAr() };
}

function emptyForm() {
  return {
    slug: '',
    title: '',
    region: '',
    theme: '',
    summary: '',
    hero: '',
    thumb: '',
    map: '',
    info: { 거리: '', 소요시간: '', 난이도: '', 집결지: '' },
    stops: [blankStop()],
    storiesText: '',
    ar: blankCourseAr(),
  };
}

function formFromCourse(course) {
  return {
    slug: course.id,
    title: course.title,
    region: course.region,
    theme: course.theme,
    summary: course.summary,
    hero: course.hero || '',
    thumb: course.thumb || '',
    map: course.map || '',
    info: {
      거리: course.info?.거리 || '',
      소요시간: course.info?.소요시간 || '',
      난이도: course.info?.난이도 || '',
      집결지: course.info?.집결지 || '',
    },
    stops: course.stops?.length
      ? course.stops.map((stop) => ({
          where: stop.where || '',
          name: stop.name || '',
          desc: stop.desc || '',
          addr: stop.addr || '',
          lat: stop.lat ?? '',
          lng: stop.lng ?? '',
          ar: stopArFromCourse(stop.ar),
        }))
      : [blankStop()],
    storiesText: (course.stories || []).join('\n'),
    ar: courseArFromCourse(course.ar),
  };
}

function loadCloudinary() {
  if (window.cloudinary) return Promise.resolve(window.cloudinary);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-cloudinary-widget]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.cloudinary), { once: true });
      existing.addEventListener('error', () => reject(new Error('widget')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://upload-widget.cloudinary.com/global/all.js';
    script.async = true;
    script.dataset.cloudinaryWidget = 'true';
    script.onload = () => resolve(window.cloudinary);
    script.onerror = () => reject(new Error('widget'));
    document.body.appendChild(script);
  });
}

function LegendCoursesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const courseId = params.get('course');
  const previousCourseId = useRef(courseId);
  const widgetRef = useRef(null);
  const uploadTarget = useRef(null); // 업로드가 끝나면 이미지 주소를 넣을 곳
  const [allowed, setAllowed] = useState(false);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

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
        const listResponse = await fetch(`${API_BASE}/api/legend-courses`);
        const saved = listResponse.ok ? await listResponse.json() : null;
        if (!ignore && Array.isArray(saved)) setCourses(saved);
        else if (!ignore) setError('전설 코스를 불러오지 못했습니다.');
      })
      .catch(() => {
        if (!ignore) navigate('/', { replace: true });
      });

    return () => {
      ignore = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (previousCourseId.current && !courseId) setForm(emptyForm());
    previousCourseId.current = courseId;
    if (!courseId) return;
    const found = courses.find((course) => course.id === courseId);
    if (found) setForm(formFromCourse(found));
  }, [courseId, courses]);

  useEffect(() => {
    return () => {
      widgetRef.current?.destroy();
      widgetRef.current = null;
    };
  }, []);

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateInfo(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, info: { ...current.info, [name]: value } }));
  }

  function updateStop(index, event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      stops: current.stops.map((stop, stopIndex) => (stopIndex === index ? { ...stop, [name]: value } : stop)),
    }));
  }

  function updateStopAr(index, event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      stops: current.stops.map((stop, stopIndex) => (stopIndex === index ? { ...stop, ar: { ...stop.ar, [name]: value } } : stop)),
    }));
  }

  function updateCourseAr(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, ar: { ...current.ar, [name]: type === 'checkbox' ? checked : value } }));
  }

  function moveStop(index, delta) {
    setForm((current) => {
      const stops = current.stops.slice();
      const target = index + delta;
      if (target < 0 || target >= stops.length) return current;
      [stops[index], stops[target]] = [stops[target], stops[index]];
      return { ...current, stops };
    });
  }

  function removeStop(index) {
    if (!window.confirm('이 경유지를 지울까요? 저장하기 전까지는 되돌릴 수 있어요.')) return;
    setForm((current) => ({ ...current, stops: current.stops.filter((_, stopIndex) => stopIndex !== index) }));
  }

  function uploadStopPhoto(index) {
    uploadTarget.current = (image) =>
      setForm((current) => ({
        ...current,
        stops: current.stops.map((stop, stopIndex) => (stopIndex === index ? { ...stop, ar: { ...stop.ar, photo: image } } : stop)),
      }));
    openImageWidget(true);
  }

  function uploadStopRestore(index) {
    uploadTarget.current = (image) =>
      setForm((current) => ({
        ...current,
        stops: current.stops.map((stop, stopIndex) => (stopIndex === index ? { ...stop, ar: { ...stop.ar, restore: image } } : stop)),
      }));
    openImageWidget(true);
  }

  async function openImageWidget(keepTarget = false) {
    if (!keepTarget) {
      uploadTarget.current = (image) =>
        setForm((current) => ({
          ...current,
          hero: image,
          thumb: !current.thumb || current.thumb === current.hero ? image : current.thumb,
        }));
    }
    try {
      const configResponse = await fetch(`${API_BASE}/api/cloudinary`);
      const config = await configResponse.json().catch(() => ({}));
      if (!configResponse.ok || !config.cloudName || !config.uploadPreset) {
        setError(config.message || 'Cloudinary 설정을 불러오지 못했습니다.');
        return;
      }

      const cloudinary = await loadCloudinary();
      if (!widgetRef.current) {
        widgetRef.current = cloudinary.createUploadWidget(
          {
            cloudName: config.cloudName,
            uploadPreset: config.uploadPreset,
            multiple: false,
            maxFiles: 1,
            resourceType: 'image',
            clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
            maxFileSize: 2_000_000,
          },
          (uploadError, result) => {
            if (uploadError) {
              setError('이미지 업로드에 실패했습니다.');
              return;
            }
            if (result?.event === 'success' && result.info?.secure_url) {
              uploadTarget.current?.(result.info.secure_url);
              setError('');
            }
          },
        );
      }
      widgetRef.current.open();
    } catch {
      setError('Cloudinary 위젯을 불러오지 못했습니다.');
    }
  }

  async function reload() {
    const listResponse = await fetch(`${API_BASE}/api/legend-courses`);
    const saved = listResponse.ok ? await listResponse.json() : null;
    if (Array.isArray(saved)) setCourses(saved);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const token = storedToken();
    const editing = Boolean(form.slug);
    setPending(true);
    try {
      const response = await fetch(
        editing ? `${API_BASE}/api/legend-courses/${form.slug}` : `${API_BASE}/api/legend-courses`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: form.title,
            region: form.region,
            theme: form.theme,
            summary: form.summary,
            hero: form.hero,
            thumb: form.thumb || form.hero,
            map: form.map,
            info: form.info,
            stops: form.stops.map((stop) => ({ ...stop, ar: stopArToBody(stop.ar) })),
            stories: form.storiesText.split('\n'),
            ar: courseArToBody(form.ar),
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.message || '코스를 저장하지 못했습니다.');
        return;
      }
      await reload();
      setForm(formFromCourse(body));
      setNotice('저장했습니다. 메인 페이지와 AR 탁본 화면에 1분 안에 반영됩니다.');
    } catch {
      setError('서버에 연결하지 못했습니다. 서버가 실행 중인지 확인해 주세요.');
    } finally {
      setPending(false);
    }
  }

  if (!allowed) return null;

  return (
    <div className="admin-app">
      <header className="admin-top">
        <div className="admin-brand">
          <Link to="/">보물 여행</Link>
          <span>ADMIN</span>
        </div>
        <Link to="/admin">대시보드로 돌아가기</Link>
      </header>

      <main className="admin-main admin-form-page">
        <h1>{form.slug ? '코스 수정' : '코스 등록'}</h1>
        <p className="admin-lead">등록된 전설 코스를 같은 항목으로 고치거나 새로 등록합니다. 저장하면 메인 페이지에 반영됩니다.</p>
        <p><Link to="/admin/courses">코스 목록으로</Link></p>

        <div className="legend-picks">
          {courses.map((course) => (
            <button key={course.id} type="button" onClick={() => setParams({ course: course.id })}>
              {course.title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setParams({});
              setForm(emptyForm());
            }}
          >
            새 전설 코스
          </button>
        </div>

        <form className="admin-form" onSubmit={onSubmit}>
          <div className="admin-field">
            <span className="admin-field-label">대표 이미지</span>
            <button className="admin-upload" type="button" onClick={() => openImageWidget()}>
              {form.hero ? <img src={form.hero} alt="전설 코스 대표 이미지" /> : <span>Cloudinary로 이미지 올리기</span>}
            </button>
          </div>

          <div className="admin-field">
            <label htmlFor="legend-title">제목</label>
            <input id="legend-title" name="title" value={form.title} onChange={update} required />
          </div>
          <div className="legend-grid">
            <div className="admin-field">
              <label htmlFor="legend-region">지역</label>
              <input id="legend-region" name="region" value={form.region} onChange={update} required />
            </div>
            <div className="admin-field">
              <label htmlFor="legend-theme">테마</label>
              <input id="legend-theme" name="theme" value={form.theme} onChange={update} required />
            </div>
          </div>
          <div className="admin-field">
            <label htmlFor="legend-summary">설명</label>
            <textarea id="legend-summary" name="summary" rows={3} value={form.summary} onChange={update} required />
          </div>

          <div className="legend-grid">
            {INFO_FIELDS.map((name) => (
              <div className="admin-field" key={name}>
                <label htmlFor={`legend-${name}`}>{name}</label>
                <input id={`legend-${name}`} name={name} value={form.info[name]} onChange={updateInfo} placeholder="입력 예정" />
              </div>
            ))}
          </div>

          <div className="admin-field">
            <span className="admin-field-label">코스 경유지</span>
            {form.stops.map((stop, index) => (
              <div className="legend-stop-card" key={index}>
                <div className="legend-stop-head">
                  <b>{index + 1}번 경유지</b>
                  <span>
                    <button type="button" onClick={() => moveStop(index, -1)} disabled={index === 0} aria-label="위로">↑</button>
                    <button type="button" onClick={() => moveStop(index, 1)} disabled={index === form.stops.length - 1} aria-label="아래로">↓</button>
                    <button type="button" onClick={() => removeStop(index)} aria-label="삭제">삭제</button>
                  </span>
                </div>
                <div className="legend-stop">
                  <input name="where" value={stop.where} onChange={(event) => updateStop(index, event)} placeholder="장소 (예: 보물 1 · 경복궁)" />
                  <input name="name" value={stop.name} onChange={(event) => updateStop(index, event)} placeholder="이야기 이름(보물 이름)" />
                  <input name="desc" value={stop.desc} onChange={(event) => updateStop(index, event)} placeholder="설명 ([미션] 뒤는 현장 미션)" />
                  <input name="addr" value={stop.addr || ''} onChange={(event) => updateStop(index, event)} placeholder="주소" />
                  <input name="lat" inputMode="decimal" value={stop.lat} onChange={(event) => updateStop(index, event)} placeholder="위도 (예: 37.5796)" />
                  <input name="lng" inputMode="decimal" value={stop.lng} onChange={(event) => updateStop(index, event)} placeholder="경도 (예: 126.9770)" />
                </div>
                <p className="legend-hint">
                  좌표가 있어야 현장 인증(GPS)과 AR 약도가 됩니다.{' '}
                  {stop.addr || stop.where ? (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.addr || stop.where)}`} target="_blank" rel="noreferrer">
                      지도에서 좌표 찾기 ↗
                    </a>
                  ) : null}
                  {' '}(지도에서 장소를 우클릭하면 위도·경도가 복사됩니다)
                </p>
                <details className="legend-ar">
                  <summary>AR 탁본 설정 {stop.ar.q ? '· 수수께끼 직접 입력됨' : '· 자동'}</summary>
                  <div className="legend-ar-grid">
                    <label>비석에 새길 장소 이름<input name="label" value={stop.ar.label} onChange={(event) => updateStopAr(index, event)} placeholder="비우면 장소에서 자동" /></label>
                    <label>보물 이름<input name="piece" value={stop.ar.piece} onChange={(event) => updateStopAr(index, event)} placeholder="비우면 이야기 이름" /></label>
                    <label className="wide">수수께끼 질문<input name="q" value={stop.ar.q} onChange={(event) => updateStopAr(index, event)} placeholder="비우면 '이야기를 읽고 보물 이름 고르기'로 자동 생성" /></label>
                    <label className="wide">질문 위 이야기 한 줄<input name="qctx" value={stop.ar.qctx} onChange={(event) => updateStopAr(index, event)} placeholder="선택" /></label>
                    <label>보기 (한 줄에 하나, 2~6개)<textarea name="optsText" rows={4} value={stop.ar.optsText} onChange={(event) => updateStopAr(index, event)} /></label>
                    <label>정답
                      <select name="a" value={stop.ar.a} onChange={(event) => updateStopAr(index, event)}>
                        <option value="">선택</option>
                        {stop.ar.optsText.split('\n').map((item) => item.trim()).filter(Boolean).map((item, k) => (
                          <option key={k} value={k}>{k + 1}. {item}</option>
                        ))}
                      </select>
                    </label>
                    <label className="wide">정답 해설<textarea name="explain" rows={2} value={stop.ar.explain} onChange={(event) => updateStopAr(index, event)} placeholder="비우면 설명으로 자동" /></label>
                    <label className="wide">현장 미션(힌트)<input name="look" value={stop.ar.look} onChange={(event) => updateStopAr(index, event)} placeholder="비우면 설명의 [미션] 뒤 문장" /></label>
                    <label className="wide">증명서 한 줄<input name="cert" value={stop.ar.cert} onChange={(event) => updateStopAr(index, event)} placeholder="비우면 자동" /></label>
                    <label className="wide">참고 사진 주소
                      <span className="legend-row">
                        <input name="photo" value={stop.ar.photo} onChange={(event) => updateStopAr(index, event)} placeholder="비우면 코스 대표 이미지" />
                        <button type="button" onClick={() => uploadStopPhoto(index)}>올리기</button>
                      </span>
                    </label>
                    <label className="wide">옛 모습 그림
                      <span className="legend-row">
                        <input name="restore" value={stop.ar.restore || ''} onChange={(event) => updateStopAr(index, event)} placeholder="카메라에 겹칠 그림 주소. 비우면 이 단계는 생략" />
                        <button type="button" onClick={() => uploadStopRestore(index)}>올리기</button>
                      </span>
                    </label>
                    <label>옛 모습 연도<input name="restoreYear" value={stop.ar.restoreYear || ''} onChange={(event) => updateStopAr(index, event)} placeholder="예: 1887" /></label>
                    <label className="wide">옛 모습 한 줄<input name="restoreCaption" value={stop.ar.restoreCaption || ''} onChange={(event) => updateStopAr(index, event)} placeholder="예: 건청궁에 켜진 첫 전등" /></label>
                    <label>3D 보물 모델
                      <select
                        value={AR_MODELS.some((m) => m.value === stop.ar.model) ? stop.ar.model : '__custom'}
                        onChange={(event) => updateStopAr(index, { target: { name: 'model', value: event.target.value === '__custom' ? stop.ar.model || 'https://' : event.target.value } })}
                      >
                        {AR_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        <option value="__custom">직접 입력(GLB 주소)</option>
                      </select>
                    </label>
                    {!AR_MODELS.some((m) => m.value === stop.ar.model) ? (
                      <label>GLB 주소<input name="model" value={stop.ar.model} onChange={(event) => updateStopAr(index, event)} /></label>
                    ) : null}
                    <label>진행 기록 키<input name="key" value={stop.ar.key} onChange={(event) => updateStopAr(index, event)} placeholder="비우면 s1, s2…" /></label>
                  </div>
                  <p className="legend-hint">진행 기록 키를 바꾸거나 경유지 순서를 바꾸면, 이미 이 장소를 탁본한 사용자의 기록이 연결되지 않을 수 있어요.</p>
                </details>
              </div>
            ))}
            <button
              className="legend-add"
              type="button"
              onClick={() => setForm((current) => ({ ...current, stops: [...current.stops, blankStop()] }))}
            >
              경유지 추가
            </button>
          </div>

          <div className="admin-field">
            <label htmlFor="legend-stories">이 코스의 이야기</label>
            <textarea
              id="legend-stories"
              rows={4}
              value={form.storiesText}
              onChange={(event) => setForm((current) => ({ ...current, storiesText: event.target.value }))}
              placeholder="한 줄에 이야기 하나씩"
            />
          </div>

          <div className="admin-field">
            <label htmlFor="legend-map">지도 이미지 주소</label>
            <input id="legend-map" name="map" value={form.map} onChange={update} placeholder="/img/지도.jpg" />
          </div>

          <fieldset className="legend-ar-course">
            <legend>AR 탁본 설정 (코스 전체)</legend>
            <label className="legend-check">
              <input type="checkbox" name="enabled" checked={form.ar.enabled} onChange={updateCourseAr} /> AR 탁본 체험 사용
            </label>
            <div className="legend-ar-grid">
              <label>비석·표지 지역 이름<input name="place" value={form.ar.place} onChange={updateCourseAr} placeholder="예: 한양 도성 (8자 이내)" /></label>
              <label>모으는 것 이름<input name="unit" value={form.ar.unit} onChange={updateCourseAr} placeholder="보물 / 부적" /></label>
              <label>완성 인장 이름<input name="finalName" value={form.ar.finalName} onChange={updateCourseAr} placeholder="비우면 '지역 이름 보물 인장'" /></label>
              <label>인장 가운데 두 글자<input name="sealShort" value={form.ar.sealShort} onChange={updateCourseAr} placeholder="예: 보물" maxLength={2} /></label>
              <label>현장 인증 반경(m)<input name="onsiteRadius" inputMode="numeric" value={form.ar.onsiteRadius} onChange={updateCourseAr} placeholder="비우면 120m" /></label>
              <label>소요 시간 표기<input name="duration" value={form.ar.duration} onChange={updateCourseAr} placeholder="비우면 정보의 소요시간" /></label>
              <label className="wide">표지 제목<input name="h1" value={form.ar.h1} onChange={updateCourseAr} placeholder="비우면 코스 제목" /></label>
              <label className="wide">표지 소개 (한 줄이 한 문단)<textarea name="storyText" rows={3} value={form.ar.storyText} onChange={updateCourseAr} placeholder="비우면 코스 설명 + 기본 안내" /></label>
              <label className="wide">완주 후 '다음 이야기' 안내<input name="nextSeason" value={form.ar.nextSeason} onChange={updateCourseAr} /></label>
            </div>
            {form.slug ? (
              <p className="legend-hint">
                <a href={`/ar/course.html?id=${encodeURIComponent(form.slug)}`} target="_blank" rel="noreferrer">AR 화면 미리보기 ↗</a>
                {' '}저장한 뒤 1분 안에 반영됩니다(캐시).
              </p>
            ) : null}
          </fieldset>

          {error ? (
            <p className="admin-form-error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <p className="legend-notice">{notice}</p> : null}
          <button className="admin-submit" type="submit" disabled={pending}>
            {pending ? '저장 중' : form.slug ? '수정하기' : '등록하기'}
          </button>
        </form>
      </main>
    </div>
  );
}

export default LegendCoursesPage;

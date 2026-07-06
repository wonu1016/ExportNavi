const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export function backendUrl(path) {
  const backendBase = API_BASE.replace(/\/api\/?$/, '');
  return `${backendBase}${path}`;
}

function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

async function request(method, path, body, { publicRequest = false } = {}) {
  const headers = {};
  const token = getToken();
  if (!publicRequest && token) headers.Authorization = 'Bearer ' + token;
  const opts = { method, headers, credentials: 'include' };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API_BASE + path, opts);
  if (res.status === 401 && !publicRequest) {
    clearToken();
    window.location.href = '/login';
    return;
  }
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'API 오류');
  }
  if (res.status === 204) return null;
  return res.json();
}

export const apiGet = (path) => request('GET', path);
export const apiPost = (path, body) => request('POST', path, body);
export const apiPatch = (path, body) => request('PATCH', path, body);
export const apiDelete = (path) => request('DELETE', path);
export const apiPublicGet = (path) => request('GET', path, undefined, { publicRequest: true });
export const apiPublicPost = (path, body) => request('POST', path, body, { publicRequest: true });
export const apiUpload = (path, formData) => request('POST', path, formData);

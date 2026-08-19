export function BadRequest(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export function NotFound(message: string) {
  return Object.assign(new Error(message), { statusCode: 404 });
}

export function Forbidden(message: string) {
  return Object.assign(new Error(message), { statusCode: 403 });
}
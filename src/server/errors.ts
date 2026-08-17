export function BadRequest(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}
export async function resolve(specifier, context, next) {
  if (specifier === 'mongoose') return { url: new URL('./mongoose-stub.mjs', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}

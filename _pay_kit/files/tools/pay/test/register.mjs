// DB 없이 결제 흐름을 시험하려고 'mongoose' 를 메모리 흉내(mongoose-stub.mjs)로 바꿉니다.
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);

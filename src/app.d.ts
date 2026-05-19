// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: {
				id: string;
				username: string;
				role: 'player' | 'admin';
			};
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: KVNamespace;
			};
		}
	}
}

export {};

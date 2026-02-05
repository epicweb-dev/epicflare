declare global {
	interface Env {
		COOKIE_SECRET: string
	}

	interface CustomExportedHandler<Props = {}> {
		fetch: (
			request: Request,
			env: Env,
			ctx: ExecutionContext<Props>,
		) => Response | Promise<Response>
	}
}

export {}

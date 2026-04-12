export class WorkerEntrypoint<Env = unknown> {
	ctx?: unknown
	env?: Env

	constructor(ctx?: unknown, env?: Env) {
		this.ctx = ctx
		this.env = env
	}
}

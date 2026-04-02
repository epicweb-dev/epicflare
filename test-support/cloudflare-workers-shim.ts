export class WorkerEntrypoint<Env = unknown> {
	constructor(
		public ctx?: ExecutionContext,
		public env?: Env,
	) {}
}

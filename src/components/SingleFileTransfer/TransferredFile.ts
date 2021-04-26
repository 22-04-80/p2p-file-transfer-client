export interface TransferredFile {
	name: string,
	size: number,
	progress: number,
	seen: boolean,
	pristine: boolean,
	buffer?: any[],
	data?: File | Blob,
}

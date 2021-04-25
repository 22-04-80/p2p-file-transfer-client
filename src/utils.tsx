export function createShareLink(peerUuid: string): string {
	const urlBase = window.location;
	const searchParams = new URLSearchParams('')
	searchParams.append('peerUuid', peerUuid);
	return `${urlBase}?${searchParams}`;
}

export function getUuidFromSearchParams(): string {
	const search = window.location.search;
	const params = new URLSearchParams(search);
	const peerUuid = params.get('peerUuid');
	return peerUuid ? peerUuid : '';
}

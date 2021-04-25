export enum ChannelEvent {
	getUuid = 'get_uuid',
	handshake = 'handshake',
	handshakeNoTarget = 'handshake_no_target',
	handshakeAccepted = 'handshake_accepted',

	newIceCandidate = 'new_ice_candidate',
	transferOffer = 'transfer_offer',
	transferAnswer = 'transfer_answer',
	transferCancel = 'transfer_cancel',
}

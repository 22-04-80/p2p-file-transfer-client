import {Channel} from "phoenix";
import React, {useCallback, useContext, useEffect, useState} from 'react';
import {Paper} from "@material-ui/core";
import {ChannelContext} from "./channel/ChannelContext";
import {ChannelEvent} from "./channel/events/ChannelEvent";
import {GetUuidReq} from "./channel/events/GetUuidReq";
import {GetUuidRes} from "./channel/events/GetUuidRes";
import {HandshakeAcceptedPayload} from "./channel/events/HandshakeAcceptedPayload";
import {HandshakeNoTargetPayload} from "./channel/events/HandshakeNoTargetPayload";
import {HandshakePayload} from "./channel/events/HandshakePayload";
import {Content} from "./components/Content/Content";
import {Loader} from "./components/Loader/Loader";
import {ShareOptions} from "./components/ShareOptions/ShareOptions";
import {getUuidFromSearchParams} from "./utils";

function App() {
	const {channel} = useContext(ChannelContext);
	const [handshaking, setHandshaking] = useState<boolean>(false);
	const [uuid, setUuid] = useState<string>('');
	const [peerUuid, setPeerUuid] = useState<string>('');
	const [peerReachedError, setPeerReachedError] = useState<HandshakeNoTargetPayload | null>(null);

	const startHandshake = useCallback((myUuid:string, peerUuid:string) => {
		const handshakePayload:HandshakePayload = {
			target: peerUuid,
			source: myUuid,
		};
		channel?.push(ChannelEvent.handshake, handshakePayload);
		setHandshaking(true);
	}, [channel]);

	useEffect(() => {
		channel?.join()
			.receive('ok', () => {
				const payload:GetUuidReq = {};
				channel?.push(ChannelEvent.getUuid, payload);
			})
			.receive('error', (error) => {
				console.log(`ERROR ${error}`);
			});

		channel?.on(ChannelEvent.getUuid, (payload:GetUuidRes) => {
			setUuid(payload.uuid);
			const peerUuid = getUuidFromSearchParams();
			if (peerUuid) {
				startHandshake(payload.uuid, peerUuid);
			}
		});

		channel?.on(ChannelEvent.handshake, (payload:HandshakePayload) => {
			setPeerUuid(payload.source);
			const handshakeAcceptedPayload:HandshakeAcceptedPayload = {source: payload.source, target: payload.target};
			channel?.push(ChannelEvent.handshakeAccepted, handshakeAcceptedPayload);
		});

		channel?.on(ChannelEvent.handshakeAccepted, (payload:HandshakeAcceptedPayload) => {
			setPeerUuid(payload.target);
			setHandshaking(false);
		});

		channel?.on(ChannelEvent.handshakeNoTarget, (payload) => {
			setPeerUuid('');
			setPeerReachedError(payload);
		});
	}, [channel, startHandshake]);

	if (!uuid) {
		return (
			<Paper elevation={3}>
				<Loader text="Loading"/>
			</Paper>
		);
	}

	if (handshaking) {
		return (
			<Paper elevation={3}>
				<Loader text="Connecting"/>
			</Paper>
		);
	}

	if (!peerUuid) {
		return (
			<Paper elevation={3}>
				<ShareOptions uuid={uuid}/>
			</Paper>
		);
	}

	return (
		<Paper elevation={3}>
			<Content uuid={uuid} peerUuid={peerUuid} channel={channel as Channel}/>
			{peerReachedError && (
				<div>Couldn't reach {peerReachedError?.target}</div>
			)}
		</Paper>
	);
}

export default App;

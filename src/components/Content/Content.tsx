import {Channel} from "phoenix";
import React from 'react';
import './Content.css';
import {SingleFileTransfer} from "../SingleFileTransfer/SingleFileTransfer";

interface Props {
	uuid: string,
	peerUuid: string,
	channel: Channel,
}

export function Content(props: Props) {
	const {peerUuid, uuid, channel} = props;
	return (
		<div className="Content">
			{uuid && peerUuid && channel && (
				<SingleFileTransfer channel={channel} uuid={uuid} peerUuid={peerUuid} />
			)}
		</div>
	)
}

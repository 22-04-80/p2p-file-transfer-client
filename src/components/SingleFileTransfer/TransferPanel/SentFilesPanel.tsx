import React from "react";
import {TransferredFile} from "../TransferredFile";
import {FileTransferProgress} from "./FileTransferProgress";

interface Props {
	sentFiles: TransferredFile[],
	setFileNotPristine:(fileType:'sent' | 'received', fileIndex:number) => void,
}

export function SentFilesPanel(props: Props) {
	const {sentFiles, setFileNotPristine} = props;

	return (
		<div>
			<div className="transfer-header">
				Sent files
			</div>
			<div className="transfer-content">
				{sentFiles.map((file, index) => (
					<FileTransferProgress
						transferredFile={file}
						setFileNotPristine={setFileNotPristine}
						fileIndex={index}
						fileType="sent"
					/>
				))}
			</div>
		</div>
	)
}

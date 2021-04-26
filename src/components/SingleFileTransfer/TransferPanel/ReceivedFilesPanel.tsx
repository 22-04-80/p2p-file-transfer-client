import React from "react";
import {TransferredFile} from "../TransferredFile";
import {FileTransferProgress} from "./FileTransferProgress";

interface Props {
	receivedFiles: TransferredFile[],
	setFileNotPristine:(fileType:'sent' | 'received', fileIndex:number) => void,
}

export function ReceivedFilesPanel(props: Props) {
	const {receivedFiles, setFileNotPristine} = props;
	return (
		<div>
			<div className="transfer-header">
				Received files
			</div>
			<div className="transfer-content">
				{receivedFiles.map((file, index) => (
					<FileTransferProgress
						transferredFile={file}
						setFileNotPristine={setFileNotPristine}
						fileIndex={index}
						fileType="received"
					/>
				))}
			</div>
		</div>
	)
}

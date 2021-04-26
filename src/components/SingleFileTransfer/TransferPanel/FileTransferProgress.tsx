import {Badge, CircularProgress, Fab} from "@material-ui/core";
import {GetApp, HourglassEmpty} from "@material-ui/icons";
import React from 'react';
import fileSize from "filesize";
import {TransferredFile} from "../TransferredFile";
import "./FileTransferProgress.css";

interface Props {
	transferredFile: TransferredFile,
	fileIndex: number,
	setFileNotPristine:(fileType:'sent' | 'received', fileIndex:number) => void,
	fileType: 'sent' | 'received',
}

export function FileTransferProgress(props: Props) {
	const {fileIndex, fileType, setFileNotPristine, transferredFile} = props;
	const success = transferredFile.progress === transferredFile.size;
	const loading = transferredFile.progress < transferredFile.size;
	const progressValue = transferredFile.progress / transferredFile.size * 100;

	return (
		<div className="FileTransferProgress">
				<div className="file-progress-content">
					<Badge variant="dot" color="secondary" invisible={!transferredFile.pristine}>
						<Fab
							aria-label="save"
							color="primary"
							className={success ? 'progress-complete' : ''}
							onClick={() => setFileNotPristine(fileType, fileIndex)}
						>
							{success
								? (
									<a
										href={URL.createObjectURL(transferredFile.data as Blob)}
										download={transferredFile.name}
									>
										<GetApp />
									</a>
								)
								: <HourglassEmpty />
							}
						</Fab>
						{loading && <CircularProgress size={68} variant="determinate" value={progressValue} className="fab-progress" />}
					</Badge>
					<div className="file-progress-info">
						<p className="file-name">{transferredFile.name}</p>
						<p className="file-size">{fileSize(transferredFile.size)}</p>
					</div>
				</div>
		</div>
	)
}
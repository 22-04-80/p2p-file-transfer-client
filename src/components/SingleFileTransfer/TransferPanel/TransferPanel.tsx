import {Badge, BottomNavigation, BottomNavigationAction} from "@material-ui/core";
import {Add, GetApp, Publish} from "@material-ui/icons";
import React, {useCallback, useEffect, useState} from 'react';
import {FileChooser} from "../FileChooser";
import {TransferredFile} from "../TransferredFile";
import {ReceivedFilesPanel} from "./ReceivedFilesPanel";
import {SentFilesPanel} from "./SentFilesPanel";
import "./TransferPanel.css";

interface Props {
	onFileSelected:(file:File) => void;
	receivingInProgress:boolean;
	sendingInProgress:boolean;
	sentFiles:TransferredFile[],
	receivedFiles:TransferredFile[],
	setAllFilesAsSeen:(fileType:'sent' | 'received') => void,
	setFileNotPristine:(fileType:'sent' | 'received', fileIndex:number) => void,
}


enum PanelName {
	choose = 'Select file',
	send = 'Sent',
	receive = 'Received',
}

function getUnseenFilesCount(files: TransferredFile[]) {
	return files.reduce((count, file) => file.seen ? count : count + 1, 0);
}

export function TransferPanel(props: Props) {
	const {onFileSelected, receivingInProgress, sendingInProgress, receivedFiles, sentFiles, setAllFilesAsSeen, setFileNotPristine} = props;
	const [activePanel, setActivePanel] = useState<PanelName>(PanelName.choose);

	useEffect(() => {
		if (receivingInProgress) {
			setActivePanel(PanelName.receive);
		}
	}, [receivingInProgress]);

	const onPanelChange = useCallback((event, newActivePanel) => {
		if (newActivePanel === PanelName.send) {
			setAllFilesAsSeen('sent');
		}
		if (newActivePanel === PanelName.receive) {
			setAllFilesAsSeen('received');
		}
		setActivePanel(newActivePanel)
	}, [setAllFilesAsSeen])

	const onSend = useCallback((file: File) => {
		onFileSelected(file);
		setActivePanel(PanelName.send);
	}, [onFileSelected]);

	return (
		<div className="TransferPanel">
			{activePanel === PanelName.choose && (
				<FileChooser onSend={onSend} disabled={receivingInProgress || sendingInProgress}/>
			)}
			{activePanel === PanelName.send && (
				<SentFilesPanel
					sentFiles={sentFiles}
					setFileNotPristine={setFileNotPristine}
				/>
			)}
			{activePanel === PanelName.receive && (
				<ReceivedFilesPanel
					receivedFiles={receivedFiles}
					setFileNotPristine={setFileNotPristine}
				/>
			)}
			<div className="transfer-footer">
				<BottomNavigation
					value={activePanel}
					onChange={onPanelChange}
					showLabels
				>
					<BottomNavigationAction
						value={PanelName.choose}
						label={PanelName.choose}
						icon={<Add />}
					/>
					<BottomNavigationAction
						value={PanelName.send}
						label={PanelName.send}
						icon={
							<Badge color="secondary" badgeContent={getUnseenFilesCount(sentFiles)}>
								<Publish />
							</Badge>
						}
					/>
					<BottomNavigationAction
						value={PanelName.receive}
						label={PanelName.receive}
						icon={
							<Badge color="secondary" badgeContent={getUnseenFilesCount(receivedFiles)}>
								<GetApp />
							</Badge>
						}
					/>
				</BottomNavigation>
			</div>
		</div>
	)
}

import React, {useCallback} from 'react';
import {useDropzone} from "react-dropzone";
import {ArrowDownward} from "@material-ui/icons";
import './FileChooser.css';

interface Props {
	onSend: (file: File) => void;
	disabled: boolean;
}

export function FileChooser(props: Props) {
	const {onSend, disabled} = props;

	const onDrop = useCallback(acceptedFiles => {
		const file = acceptedFiles[0];
		onSend(file);
	}, [onSend]);
	const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop})
	const className = isDragActive ? 'FileChooser drag' : 'FileChooser select'

	return (
		<div {...getRootProps()} className={className}>
			<input {...getInputProps()} multiple={false} disabled={disabled}/>
			{
				isDragActive ?
					<>
						<ArrowDownward />
						Drop the file here
					</> :
					<>
						Drop file here, or
						&nbsp;
						<span className="browse">click to browse</span>
					</>
			}
		</div>
	)
}

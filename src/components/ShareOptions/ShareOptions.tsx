import {Fab, Fade, Snackbar, Switch} from "@material-ui/core";
import {Check, Error, FileCopy} from "@material-ui/icons";
import QRCode from "qrcode";
import React, {useEffect, useRef, useState} from 'react';
import {createShareLink} from "../../utils";
import './ShareOptions.css';

interface Props {
	uuid:string,
}

export const ShareOptions = (props:Props) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [useQRCode, setUseQRCode] = useState<boolean>(false);
	const [shouldDisplayLink, setShouldDisplayLink] = useState<boolean>(false);
	const [linkCopied, setLinkCopied] = useState<boolean>(false);

	useEffect(() => {
		if (useQRCode && canvasRef.current && props.uuid) {
			QRCode.toCanvas(canvasRef.current, createShareLink(props.uuid),
				(error) => {if (error) console.log("qrcode generation error", error);});
		}
	}, [props.uuid, useQRCode]);

	const copyLinkToClipboard = async () => {
		if (window.isSecureContext) {
			await navigator.clipboard.writeText(createShareLink(props.uuid));
		}
		else {
			setShouldDisplayLink(true);
		}
		setLinkCopied(true);
	};

	// const notificationClassName = `notification`

	return (
		<div className="ShareOptions">
			<div className="share-header">
				<span
					className="option"
					onClick={() => setUseQRCode(false)}
				>
					Use link
				</span>
				<Switch
					checked={useQRCode}
					onChange={() => setUseQRCode(!useQRCode)}
				/>
				<span
					className="option"
					onClick={() => setUseQRCode(true)}
				>
					Scan QR code
				</span>
			</div>
			<div className="share-content">
				{useQRCode && (
					<Fade in={useQRCode}>
						<canvas ref={canvasRef}/>
					</Fade>
				)}
				{!useQRCode && (
					<Fade in={!useQRCode}>
						{shouldDisplayLink ? (
							<div>
								{createShareLink(props.uuid)}
							</div>
						) : (
							<Fab
								variant="extended"
								color="secondary"
								onClick={copyLinkToClipboard}
							>
								<FileCopy />
								Copy to clipboard
							</Fab>
						)}
					</Fade>
				)}
				<Snackbar open={linkCopied} autoHideDuration={2000} onClose={() => setLinkCopied(false)}>
					<div className={`notification ${shouldDisplayLink ? 'error' : 'success'}`}>
						{shouldDisplayLink ?  <Error /> : <Check />}
						{shouldDisplayLink ? 'Failed to copy link' : 'Link copied'}
					</div>
				</Snackbar>
			</div>
		</div>
	);
};
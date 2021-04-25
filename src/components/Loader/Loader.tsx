import React from 'react';
import './Loader.css';

interface Props {
	text:string,
}

export function Loader(props:Props) {
	return (
		<div className="Loader loader-text">
			{props.text}
		</div>
	);
}

import React from 'react';
import classNames from 'classnames';

const Role = ({ data, toggleFilterRole, filterRole }) => {
	const className = classNames(
		'rounded',
		'p-1 px-3 m-1',
		'cursor-pointer',
		'no-underline',
		'border-2 border-gray-900',
		'text-black font-bold',
		{ 'bg-white': filterRole !== data },
		{ 'bg-gray-300': filterRole == data },
		'transition duration-200 ease-in-out hover:bg-glitch'
	);
	return (
		<a href={`#${data.id}`}>
			<button className={className}>{data.name}</button>
		</a>
	);
};

export default Role;

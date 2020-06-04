import React from 'react';
import Icon from './Icon';

function URLify(string) {
	var urls = string.match(/(((https?):\/\/)[\-\w@:%_\+.~#?,&\/\/=]+)/g);
	if (urls) {
		urls.forEach(function (url) {
			string = string.replace(url, '<a target="_blank" href="' + url + '">' + url + '</a>');
		});
	}
	return string.replace('(', '<br/>(');
}

const description = (summary) => {
	return { __html: URLify(summary) };
};

const Card = ({ record: { name, role, location, remote, github, twitter, linkedin, summary, personal } }) => {
	return (
		<div className="bg-white relative shadow overflow-hidden sm:rounded-lg hover:bg-glitch hover:shadow-xl shadow transition duration-500 ease-in-out">
			<div className="m-6">
				<div>
					<div className="flex">
						<h3 className="text-2xl leading-6 font-medium text-gray-900 mb-4 w-full">{name}</h3>
						<div className="flex justify-end w-full">
							{linkedin && (
								<a href={`${linkedin}`} target="_blank">
									<Icon name="linkedin" />
								</a>
							)}
							{github && (
								<a href={`${github}`} target="_blank">
									<Icon name="github" />
								</a>
							)}
							{twitter && (
								<a href={`${twitter}`} target="_blank">
									<Icon name="twitter" />
								</a>
							)}
							{personal && (
								<a href={`${personal}`} target="_blank">
									<Icon name="personal" />
								</a>
							)}
						</div>
					</div>
					<div className="text-gray-800 text-sm">
						{location} {remote && <span>Remote</span>}
					</div>
					<div>
						{personal && (
							<a href={personal} target="_blank">
								{personal}
							</a>
						)}
					</div>

					<div className="pt-6" dangerouslySetInnerHTML={description(summary)}></div>
				</div>
			</div>
		</div>
	);
};

export default Card;

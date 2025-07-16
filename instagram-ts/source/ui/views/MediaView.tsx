//Generic view for feeds and stories
//
//import React from 'react';
//import {useApp} from 'ink';
//import {Box, Text} from 'ink';
//import {useClient} from '../context/ClientContext.js';



//export default function MediaView() {
//		const {exit} = useApp();

//		const [currentView, setCurrentView] = React.useState<'feed' | 'stories'>('feed');

//		//I just want to check the client prpoperties
//		const client = useClient();
//		React.useEffect(() => {
//			if (!client) {
//				exit();
//				return;
//			}

//			// Log client properties for debugging
//			console.log('Client properties:', Object.keys(client));
//		}, [client, exit]);

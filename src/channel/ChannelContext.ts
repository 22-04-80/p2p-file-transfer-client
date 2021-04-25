import {createContext} from 'react';
import {IChannelContext} from "./IChannelContext";

export const ChannelContext = createContext<IChannelContext>({});

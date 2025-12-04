#!/usr/bin/env ucode

'use strict';

import { cursor } from 'uci';

const uci = cursor();

const methods = {
	get_openwrt_info: {
		call: function() {
			const result = {
				name: "get_openwrt_info 调用了",
			};
			return result;
		}
	}
};

return { 'luci.zdinnav': methods };

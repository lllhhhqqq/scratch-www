const cookie = require('cookie');
const defaults = require('lodash.defaults');
const xhr = require('xhr');
const pako = require('pako');

/**
 * Module that handles coookie interactions.
 *     (Cookies?!?! Jar?!?! Get it?!?! WE'RE AMAZING!!!!)
 *
 * get(name, callback) – can be sync or async, as callback is optional
 * set(name, value) – synchronously sets the cookie
 * use(name, uri, callback) – can by sync or async, gets cookie from the uri if not there.
 */
const Jar = {
    unsign: (value, callback) => {
        // Return the usable content portion of a signed, compressed cookie generated by
        // Django's signing module
        // https://github.com/django/django/blob/stable/1.8.x/django/core/signing.py
        if (typeof value === 'undefined') return callback(null, value);
        
        try {
            let b64Data = value.split(':')[0];
            let decompress = false;
            if (b64Data[0] === '.') {
                decompress = true;
                b64Data = b64Data.substring(1);
            }

            // Django makes its base64 strings url safe by replacing + and / with - and _ respectively
            // using base64.urlsafe_b64encode
            // https://docs.python.org/2/library/base64.html#base64.b64encode
            b64Data = b64Data.replace(
                /[-_]/g,
                c => ({
                    '-': '+',
                    '_': '/'
                }[c])
            );
            let strData = atob(b64Data);

            if (decompress) {
                const charData = strData.split('').map(c => (c.charCodeAt(0)));
                const binData = new Uint8Array(charData);
                const data = pako.inflate(binData);
                strData = String.fromCharCode.apply(null, new Uint16Array(data));
            }
            return callback(null, strData);
        } catch (e) {
            return callback(e);
        }
    },
    get: (name, callback) => {
        // Get cookie by name
        const obj = cookie.parse(document.cookie) || {};

        // Handle optional callback
        if (typeof callback === 'function') {
            if (typeof obj === 'undefined') return callback('Cookie not found.');
            return callback(null, obj[name]);
        }

        return obj[name];
    },
    use: (name, uri, callback) => {
        // Attempt to get cookie
        Jar.get(name, (err, obj) => {
            if (typeof obj !== 'undefined') return callback(null, obj);

            // Make XHR request to cookie setter uri
            xhr({
                uri: uri
            }, e => {
                if (e) return callback(e);
                Jar.get(name, callback);
            });
        });
    },
    set: (name, value, opts) => {
        opts = opts || {};
        defaults(opts, {
            expires: new Date(new Date().setYear(new Date().getFullYear() + 1)),
            sameSite: 'Strict' // cookie library requires this capitialization of sameSite
        });
        opts.path = '/';
        const obj = cookie.serialize(name, value, opts);
        document.cookie = obj;
    },
    getUnsignedValue: (cookieName, signedValue, callback) => {
        // Get a value from a signed object
        Jar.get(cookieName, (err, value) => {
            if (err) return callback(err);
            if (typeof value === 'undefined') return callback(null, value);
            
            Jar.unsign(value, (e, contents) => {
                if (e) return callback(e);
                
                try {
                    const data = JSON.parse(contents);
                    return callback(null, data[signedValue]);
                } catch (error) {
                    return callback(error);
                }
            });
        });
    }
};

module.exports = Jar;

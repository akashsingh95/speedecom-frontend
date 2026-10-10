import { useState, useCallback, useRef } from 'react';
import api from '../api';
import { parseGstin, STATE_CODES } from '../utils/gstinUtils';

export function useGstAutoFill() {
    const [captchaImg, setCaptchaImg] = useState('');
    const [captchaCookie, setCaptchaCookie] = useState('');
    const [loadingCaptcha, setLoadingCaptcha] = useState(false);
    const [fetchingDetails, setFetchingDetails] = useState(false);
    const [gstError, setGstError] = useState('');
    const cookieRef = useRef('');

    const fetchCaptcha = useCallback(async () => {
        setLoadingCaptcha(true);
        setGstError('');
        try {
            const { data } = await api.get('/gst/captcha');
            const result = data?.data || data;
            setCaptchaImg(result.captcha_image);
            setCaptchaCookie(result.captcha_cookie);
            cookieRef.current = result.captcha_cookie;
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to fetch captcha. Try again.';
            setGstError(msg);
        } finally {
            setLoadingCaptcha(false);
        }
    }, []);

    const resetCaptcha = useCallback(() => {
        setCaptchaImg('');
        setCaptchaCookie('');
        cookieRef.current = '';
        setGstError('');
    }, []);

    const lookupGst = useCallback(async (gstin, captchaText) => {
        const c = gstin.trim().toUpperCase();
        const parsed = parseGstin(c);
        if (!parsed.valid) {
            setGstError('Invalid GSTIN format');
            return null;
        }

        const cookie = cookieRef.current || captchaCookie;
        if (!cookie) {
            setGstError('Captcha not loaded. Please refresh the captcha.');
            return null;
        }

        setFetchingDetails(true);
        setGstError('');
        try {
            const { data } = await api.post('/gst/details', {
                gst_number: c,
                captcha: captchaText.trim(),
                captcha_cookie: cookie,
            });

            const gstResponse = data?.data || data;
            const legalName = gstResponse.lgnm || '';
            const tradeName = gstResponse.tradeNam || '';
            const address = gstResponse.pradr?.adr || '';
            const businessNature = gstResponse.nba || '';
            const companyType = gstResponse.ctb || '';

            const result = {
                legalName,
                tradeName,
                businessName: tradeName || legalName,
                address,
                businessNature,
                companyType,
                gstin: c,
                pan: parsed.pan,
                stateCode: parsed.stateCode,
                state: parsed.stateName || STATE_CODES[parsed.stateCode] || '',
            };

            setCaptchaImg('');
            setCaptchaCookie('');
            cookieRef.current = '';

            return result;
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to fetch GST details';
            setGstError(msg);
            return null;
        } finally {
            setFetchingDetails(false);
        }
    }, [captchaCookie]);

    return {
        captchaImg,
        loadingCaptcha,
        fetchingDetails,
        gstError,
        fetchCaptcha,
        lookupGst,
        resetCaptcha,
    };
}

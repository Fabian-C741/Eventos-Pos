import { useEffect, useState } from 'react';
import { api } from '../api/client';

export interface AppBrand {
  app_name: string;
  login_logo: string;
}

export function useAppBrand(): AppBrand {
  const [brand, setBrand] = useState<AppBrand>({ app_name: '', login_logo: '' });

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get<AppBrand>('/auth/login-config')
        .then((b) => {
          if (active) setBrand(b);
        })
        .catch(() => {});
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return brand;
}
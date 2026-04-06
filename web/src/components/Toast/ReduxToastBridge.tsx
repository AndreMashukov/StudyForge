import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectToast, hideToast } from '../../store/slices/uiSlice';
import { useToast } from './ToastContext';

/**
 * Bridges Redux uiSlice toast state to the ToastContext.
 * Allows API onQueryStarted callbacks (which can only dispatch) to trigger
 * toasts rendered by the ToastContext UI.
 */
export const ReduxToastBridge = () => {
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const reduxToast = useSelector(selectToast);
  const lastToastRef = useRef<typeof reduxToast>(null);

  useEffect(() => {
    if (reduxToast?.show && reduxToast !== lastToastRef.current) {
      lastToastRef.current = reduxToast;
      const variant = reduxToast.type === 'success' ? 'success'
        : reduxToast.type === 'error' ? 'error'
        : 'info';
      showToast(reduxToast.message, variant);
      dispatch(hideToast());
    }
  }, [reduxToast, showToast, dispatch]);

  return null;
};

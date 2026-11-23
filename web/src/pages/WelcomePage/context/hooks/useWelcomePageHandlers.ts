import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../../../hooks/redux';
import {
  authApi,
  useSkipOnboardingMutation,
} from '../../../../store/api/Auth/authApi';
import { useStartAgentTurnMutation } from '../../../../store/api/AgentThread/AgentThreadApi';
import { readAgentRequestErrorMessage } from '../../../../components/AgentPanel/agentPanelErrors';
import { formatLocalIsoDate } from '../../../../utils/dateUtils';
import type { IWelcomePageHandlers } from '../../types/IWelcomePageContext';
import { normalizeWelcomeSubject } from '../../utils/welcomePageView';

export function useWelcomePageHandlers(): IWelcomePageHandlers {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [subject, setSubject] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [startedThreadId, setStartedThreadId] = useState<string | undefined>();
  const [startAgentTurn, { isLoading: isStarting }] = useStartAgentTurnMutation();
  const [skipOnboarding, { isLoading: isSkipping }] = useSkipOnboardingMutation();

  const handleSubjectChange = useCallback((value: string) => {
    setSubject(value);
    setError(null);
  }, []);

  const handleStartCourse = useCallback(
    (chosen?: string) => {
      const normalized = normalizeWelcomeSubject(chosen ?? subject);
      if (!normalized || isStarting) {
        if (!normalized) {
          setError('Tell us what you want to study.');
        }
        return;
      }
      setSubject(normalized);
      setError(null);
      const threadId = crypto.randomUUID();
      void startAgentTurn({
        scope: 'workspace',
        message: normalized,
        threadId,
        turnId: crypto.randomUUID(),
        clientLocalDate: formatLocalIsoDate(),
        intent: 'starter_course',
      })
        .unwrap()
        .then(() => {
          setStartedThreadId(threadId);
          dispatch(authApi.util.invalidateTags(['UserProfile']));
        })
        .catch((startError: unknown) => {
          setError(
            readAgentRequestErrorMessage(
              startError,
              'Could not start your course. Please try again.',
            ),
          );
        });
    },
    [dispatch, isStarting, startAgentTurn, subject],
  );

  const handleSkip = useCallback(() => {
    void skipOnboarding()
      .unwrap()
      .then(() => navigate('/', { replace: true }))
      .catch(() => setError('Could not skip right now. Please try again.'));
  }, [navigate, skipOnboarding]);

  // The agent created something: refresh the profile so the course folder link appears.
  const handleAgentMutated = useCallback(() => {
    dispatch(authApi.util.invalidateTags(['UserProfile']));
  }, [dispatch]);

  return {
    subject,
    isStarting,
    isSkipping,
    error,
    startedThreadId,
    handleSubjectChange,
    handleStartCourse,
    handleSkip,
    handleAgentMutated,
  };
}

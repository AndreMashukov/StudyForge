import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { ChevronLeft } from 'lucide-react';
import { SubjectWorldZone } from '@shared-types';
import { useSubjectWorldPageContext } from '../context/hooks/useSubjectWorldPageContext';
import { Spinner } from '../../../components/ui/Spinner';
import { SubjectWorldCanvas, ISubjectWorldUnlockCelebration } from '../../../components/SubjectWorldCanvas';
import { SubjectWorldHud } from '../../../components/SubjectWorldHud';
import { SubjectWorldZoneBanner } from '../../../components/SubjectWorldZoneBanner';
import { SubjectWorldInteractionPanel } from '../../../components/SubjectWorldPanel';
import {
  adaptSubjectWorldSpecToSceneModel,
  findGateMarkerPosition,
  findPortalForGateUnlock,
  ISceneMarker,
} from '../utils/subjectWorldSceneAdapter';
import {
  selectSubjectWorldPageState,
} from '../../../store/slices/subjectWorldPageSlice';
import { DirectoryChatPanel } from '../../../components/DirectoryChatPanel';

export const SubjectWorldPageContainer: React.FC = () => {
  const { subjectWorldApi, handlers } = useSubjectWorldPageContext();
  const {
    handleInteract,
    handleNearMarkerChange: syncNearMarker,
    handleInteractMarker,
    handleBackToDirectory,
    handleClosePanel,
    handleSelectGateAnswer,
    handleSubmitGateAnswer,
  } = handlers;
  const pageState = useSelector(selectSubjectWorldPageState);
  const [nearMarker, setNearMarker] = useState<ISceneMarker | null>(null);
  const [zoneBanner, setZoneBanner] = useState<SubjectWorldZone | null>(null);
  const [unlockCelebration, setUnlockCelebration] = useState<ISubjectWorldUnlockCelebration | null>(null);
  const prevUnlockedGateIdsRef = useRef<string[]>([]);
  const zoneBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockCelebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onInteract = () => handleInteract();
    window.addEventListener('subject-world-interact', onInteract);
    return () => window.removeEventListener('subject-world-interact', onInteract);
  }, [handleInteract]);

  const handleNearMarkerChange = useCallback(
    (marker: ISceneMarker | null) => {
      setNearMarker(marker);
      syncNearMarker(marker);
    },
    [syncNearMarker],
  );

  const sceneModel = useMemo(() => {
    if (!subjectWorldApi.subjectWorld?.worldSpec) return null;
    return adaptSubjectWorldSpecToSceneModel(
      subjectWorldApi.subjectWorld.worldSpec,
      pageState.progress.unlockedGateIds
    );
  }, [subjectWorldApi.subjectWorld?.worldSpec, pageState.progress.unlockedGateIds]);

  const handleZoneEnter = useCallback((zone: SubjectWorldZone | null) => {
    if (!zone) return;

    setZoneBanner(zone);
    if (zoneBannerTimeoutRef.current) {
      clearTimeout(zoneBannerTimeoutRef.current);
    }
    zoneBannerTimeoutRef.current = setTimeout(() => {
      setZoneBanner(null);
    }, 3500);
  }, []);

  useEffect(() => {
    const prevIds = prevUnlockedGateIdsRef.current;
    const currentIds = pageState.progress.unlockedGateIds;
    const newlyUnlocked = currentIds.find((id) => !prevIds.includes(id));
    prevUnlockedGateIdsRef.current = currentIds;

    if (!newlyUnlocked || !sceneModel) return;

    const portal = findPortalForGateUnlock(sceneModel, newlyUnlocked);
    const gatePosition = findGateMarkerPosition(sceneModel, newlyUnlocked);
    const position = portal
      ? { x: portal.x, y: portal.y + 1.5, z: portal.z }
      : gatePosition;

    if (!position) return;

    setUnlockCelebration({
      gateId: newlyUnlocked,
      x: position.x,
      y: position.y,
      z: position.z,
    });

    if (unlockCelebrationTimeoutRef.current) {
      clearTimeout(unlockCelebrationTimeoutRef.current);
    }
    unlockCelebrationTimeoutRef.current = setTimeout(() => {
      setUnlockCelebration(null);
    }, 2500);
  }, [pageState.progress.unlockedGateIds, sceneModel]);

  useEffect(
    () => () => {
      if (zoneBannerTimeoutRef.current) clearTimeout(zoneBannerTimeoutRef.current);
      if (unlockCelebrationTimeoutRef.current) clearTimeout(unlockCelebrationTimeoutRef.current);
    },
    []
  );

  const backButton = (
    <button
      type="button"
      onClick={handleBackToDirectory}
      className="absolute left-4 top-4 z-30 flex items-center gap-1 rounded-md bg-background/80 px-3 py-2 text-sm font-medium text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4 shrink-0" />
      Back
    </button>
  );

  if (subjectWorldApi.isLoading || !subjectWorldApi.hasValidId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="md" />
        <p className="ml-4">Loading subject world…</p>
      </div>
    );
  }

  if (subjectWorldApi.error || subjectWorldApi.isError || !subjectWorldApi.subjectWorld) {
    return (
      <div className="mx-auto flex h-screen max-w-4xl flex-col items-center justify-center px-6">
        {backButton}
        <h2 className="mb-4 text-2xl font-bold text-destructive">Error loading subject world</h2>
        <button
          type="button"
          onClick={() => subjectWorldApi.refetch()}
          className="rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (subjectWorldApi.subjectWorld.generationStatus === 'pending') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        {backButton}
        <Spinner size="md" />
        <p className="text-muted-foreground">Generating your explorable world…</p>
      </div>
    );
  }

  if (subjectWorldApi.subjectWorld.generationStatus === 'failed') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        {backButton}
        <h2 className="text-xl font-semibold text-destructive">Generation failed</h2>
        <p className="text-sm text-muted-foreground">
          {subjectWorldApi.subjectWorld.generationError ?? 'Unknown error'}
        </p>
      </div>
    );
  }

  if (!sceneModel) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">World data unavailable.</p>
      </div>
    );
  }

  const world = subjectWorldApi.subjectWorld;
  const directoryId = world.directoryId;

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {backButton}
      <SubjectWorldHud
        title={world.title}
        quests={world.worldSpec.quests}
        progress={pageState.progress}
        nearMarker={nearMarker}
        isWorldComplete={pageState.phase === 'completed'}
        theme={world.worldSpec.theme}
        accessibleZoneCount={sceneModel.accessibleZoneIds.length}
        totalZoneCount={sceneModel.zones.length}
      />
      <SubjectWorldZoneBanner zone={zoneBanner} />
      <div className="h-full w-full">
        <SubjectWorldCanvas
          sceneModel={sceneModel}
          nearestMarkerId={nearMarker?.id ?? null}
          onNearMarkerChange={handleNearMarkerChange}
          onMarkerClick={handleInteractMarker}
          onZoneEnter={handleZoneEnter}
          unlockCelebration={unlockCelebration}
        />
      </div>
      <SubjectWorldInteractionPanel
        poi={pageState.activePoi}
        gate={pageState.activeGate}
        selectedGateAnswer={pageState.selectedGateAnswer}
        gateAnswerFeedback={pageState.gateAnswerFeedback}
        onClose={handleClosePanel}
        onSelectGateAnswer={handleSelectGateAnswer}
        onSubmitGateAnswer={handleSubmitGateAnswer}
      />
      {pageState.phase === 'completed' && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="pointer-events-auto mx-4 max-w-md rounded-lg border border-accent/40 bg-background/95 px-6 py-5 text-center shadow-xl">
            <p className="text-sm font-medium uppercase tracking-wide text-accent">World complete</p>
            <h2 className="mt-2 text-2xl font-bold">{world.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You finished every quest. Explore freely or head back to your directory.
            </p>
            <button
              type="button"
              onClick={handleBackToDirectory}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to directory
            </button>
          </div>
        </div>
      )}
      {directoryId && (
        <div className="absolute bottom-4 right-4 z-20 max-w-[calc(100vw-2rem)]">
          <DirectoryChatPanel
            directoryId={directoryId}
            collapsible
            defaultExpanded={false}
            compact
            className="border-border bg-background/95 shadow-lg backdrop-blur"
            artifactContext={{
              type: 'subjectWorld',
              title: world.title,
              question: pageState.activePoi?.label ?? pageState.activeGate?.label,
            }}
          />
        </div>
      )}
    </div>
  );
};

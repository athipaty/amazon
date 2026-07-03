import DealSearchPanel from '../components/DealSearchPanel';

export default function DealsPage({ tracker }) {
  const { handleTrackDeal, trackedAsins } = tracker;

  return (
    <div className="px-3 py-4 md:px-6 md:py-7 max-w-[1600px] mx-auto">
      <DealSearchPanel onTrack={handleTrackDeal} trackedAsins={trackedAsins} defaultOpen />
    </div>
  );
}

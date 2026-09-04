import { Creators } from "@/components/creators/creators";

// Hidden route (not in the nav). It keeps its own light header, so the page
// supplies the content container that the hero-led tabs provide themselves.
export default function CreatorsPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-6 py-8">
      <Creators />
    </div>
  );
}

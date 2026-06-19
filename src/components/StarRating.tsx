import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  max?: number;
}

export function StarRating({ rating, max = 5 }: StarRatingProps) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating
              ? "fill-star text-star"
              : "fill-star-empty text-star-empty"
          }`}
        />
      ))}
    </div>
  );
}

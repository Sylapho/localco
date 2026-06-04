type ProductInfoPopoverProps = {
  ingredients?: string | null
  allergenes?: string | null
}

export default function ProductInfoPopover({
  ingredients,
  allergenes,
}: ProductInfoPopoverProps) {
  const hasInfo = Boolean(ingredients || allergenes)

  if (!hasInfo) {
    return null
  }

  return (
    <details className="group rounded-2xl border border-[#eee2e7] bg-[#faf7f8] px-3 py-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-[#5a0037]">
        <span>Infos produit</span>
        {allergenes ? (
          <span className="rounded-full bg-white px-2 py-1 text-xs text-red-600">
            Allergènes
          </span>
        ) : null}
      </summary>

      <div className="mt-3 max-h-32 overflow-y-auto pr-1 text-[#4a3d43]">
        {allergenes ? (
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-red-600">
              Allergènes
            </p>
            <p className="mt-1 leading-6">{allergenes}</p>
          </div>
        ) : null}

        {ingredients ? (
          <div className={allergenes ? 'mt-3' : ''}>
            <p className="text-xs font-black uppercase tracking-wide text-[#b5006e]">
              Ingrédients
            </p>
            <p className="mt-1 leading-6">{ingredients}</p>
          </div>
        ) : null}
      </div>
    </details>
  )
}

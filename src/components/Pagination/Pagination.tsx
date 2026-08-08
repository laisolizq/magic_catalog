interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

function buildPages(totalPages: number) {
  return Array.from({ length: totalPages }, (_, index) => index + 1)
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Prev
      </button>

      {buildPages(totalPages).map((page) => (
        <button
          key={page}
          type="button"
          className={page === currentPage ? 'is-current' : ''}
          onClick={() => onPageChange(page)}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </nav>
  )
}

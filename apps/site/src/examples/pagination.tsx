import { useState } from "react"

import { Pagination } from "@/components/ui/pagination"

export default function PaginationDemo() {
  const [page, setPage] = useState(3)
  return <Pagination aria-label="Task pages" page={page} pageCount={12} onPageChange={setPage} />
}

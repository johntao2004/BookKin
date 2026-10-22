import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { TestProviders } from "../test/TestProviders";
import { ApiRequestError } from "../api/client";
import { HttpErrorPage, pageFailure } from "./HttpErrorPage";

it.each([400, 401, 403, 404, 405, 408, 409, 413, 415, 422, 429, 500, 502, 503, 504])("retains HTTP %s diagnostics in a full-page surface", status => {
  render(<TestProviders><HttpErrorPage failure={pageFailure(new ApiRequestError("可供排查的原因", status, "TEST_ERROR", "test-trace-12345678"))} /></TestProviders>);
  const page = screen.getByRole("alert", { name: "错误页面" });
  expect(page).toHaveTextContent(String(status));
  expect(page).toHaveTextContent("原因：可供排查的原因");
  expect(page).toHaveTextContent("错误代码：TEST_ERROR");
  expect(page).toHaveTextContent("请求标识：test-trace-12345678");
});
it("does not invent an HTTP 500 for a connection failure", () => {
  render(<TestProviders><HttpErrorPage failure={pageFailure(new Error("连接书库服务超时"))} /></TestProviders>);
  expect(screen.getByRole("alert")).toHaveTextContent("CONNECTION_ERROR");
  expect(screen.getByRole("alert")).not.toHaveTextContent("500");
});

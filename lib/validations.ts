import { z } from "zod";
import { sanitizeProductText } from "@/lib/pdf-parser";

/**
 * Schema de validação para cadastro e edição de loja ('stores'):
 * - name: mínimo de 3 caracteres
 * - code: opcional
 * - city: opcional
 * - status: 'active' | 'inactive' (opcional, padrão 'active')
 */
export const storeSchema = z.object({
  name: z
    .string({ required_error: "O nome da loja é obrigatório." })
    .transform((val) => sanitizeProductText(val))
    .refine((val) => val.length >= 3, {
      message: "O nome da loja deve ter no mínimo 3 caracteres.",
    }),
  code: z
    .string()
    .optional()
    .default("")
    .transform((val) => sanitizeProductText(val).toUpperCase()),
  city: z
    .string()
    .optional()
    .default("")
    .transform((val) => sanitizeProductText(val)),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

/**
 * Schema de validação para cada item do pedido ('order_items'):
 * - product_name: não vazio, sanitizado contra XSS
 * - quantity: número positivo > 0
 * - unit_price: número >= 0
 * - total_price: número >= 0 (opcional, calculado se omitido)
 */
export const orderItemSchema = z.object({
  product_name: z
    .string({ required_error: "O nome do produto é obrigatório." })
    .transform((val) => sanitizeProductText(val))
    .refine((val) => val.length >= 1, {
      message: "O nome do produto não pode estar vazio.",
    }),
  quantity: z.coerce
    .number({ invalid_type_error: "A quantidade deve ser um número válido." })
    .positive("A quantidade deve ser um número positivo maior que 0.")
    .max(1000000, "Quantidade acima do limite permitido."),
  unit_price: z.coerce
    .number({ invalid_type_error: "O preço unitário deve ser um número válido." })
    .min(0, "O valor unitário deve ser maior ou igual a 0.")
    .max(100000000, "Valor unitário acima do limite permitido."),
  total_price: z.coerce
    .number()
    .min(0, "O valor total deve ser maior ou igual a 0.")
    .optional(),
});

/**
 * Schema de validação para registro completo de pedido ('orders' + 'order_items')
 */
export const orderSchema = z.object({
  store_id: z
    .string({ required_error: "Selecione uma loja." })
    .uuid("ID da loja inválido."),
  reference_month: z
    .string({ required_error: "Informe o mês de referência." })
    .regex(
      /^\d{4}-\d{2}-01$/,
      "Mês de referência inválido (formato esperado: YYYY-MM-01)."
    ),
  pdf_url: z.string().nullable().optional(),
  items: z
    .array(orderItemSchema)
    .min(1, "O pedido deve conter ao menos 1 item válido."),
});

export type StoreInput = z.infer<typeof storeSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type OrderInput = z.infer<typeof orderSchema>;

export function formatZodErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "geral",
    message: issue.message,
  }));
}

import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "../env";
import { ClientError } from "../errors/client-error";
import { dayjs } from '../lib/dayjs';
import { getMailClient } from "../lib/mail";
import { prisma } from "../lib/prisma";


export async function confirmTrip(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/trips/:tripId/confirm', {
    schema: {
      params: z.object({
        tripId: z.string().uuid()
      })
    }
  }, async (request, reply) => {
    const { tripId } = request.params

    const trip = await prisma.trip.findUnique({
      where: {
        id: tripId
      },
      include: {
        participants: {
          where: { is_owner: false}
        }
      }
    })

    if (!trip) {
      throw new ClientError("Trip not found");
    }

    if (trip.is_confirmed) {
      return reply.redirect(`${env.WEB_BASE_URL}/trips/${tripId}`);
    }

    const formattedStartDate = dayjs(trip.starts_at).format('LL')
    const formattedEndDate = dayjs(trip.starts_at).format('LL')

    const mail = await getMailClient()

    await Promise.all(
      trip.participants.map(async (participant) => {
        const confirmationLink = `${env.API_BASE_URL}/participants/${participant.id}/confirm`

        await mail.sendMail({
          from: 'Equipe Trip <trip@trip.com>',
          to: participant.email,
          subject: 'Confirme sua presença no seu viagem',
          html: `
            <p>Olá, ${participant.name}</p>
            <p>Você foi convidado para participar de uma viagem para ${trip.destination}</p>
            <p>Data: ${formattedStartDate} até ${formattedEndDate}</p>
            <p>Confirme sua presença clicando no link abaixo:</p>
            <a href="${confirmationLink}">Confirmar presença</a>
          `
        })
      })
    )

    return reply.redirect(`${env.WEB_BASE_URL}/trips/${tripId}`);
  });
}
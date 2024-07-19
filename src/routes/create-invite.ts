
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "../env";
import { ClientError } from "../errors/client-error";
import { dayjs } from '../lib/dayjs';
import { getMailClient } from "../lib/mail";
import { prisma } from "../lib/prisma";


export async function createInvite(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/trips/:tripId/invites', {
    schema: {
      body: z.object({
        email: z.string().email(),

      }),
      params: z.object({
        tripId: z.string().uuid()
      })
    }
  }, async (request) => {
    const { tripId } = request.params;
    const { email } = request.body;

    const trip = await prisma.trip.findUnique({
      where: {
        id: tripId
      }
    });

    if (!trip) {
      throw new ClientError('Trip not found')
    }

    const participant = await prisma.participant.create({
      data: {
        email,
        trip_id: tripId
      }
    });

    const formattedStartDate = dayjs(trip.starts_at).format('LL')
    const formattedEndDate = dayjs(trip.starts_at).format('LL')

    const mail = await getMailClient()


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

    return { participantId: participant.id }
  });
}